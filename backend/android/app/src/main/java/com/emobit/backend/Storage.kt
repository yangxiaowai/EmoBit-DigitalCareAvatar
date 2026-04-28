package com.emobit.backend

import android.content.Context
import androidx.room.Room
import com.emobit.backend.db.AppDb
import com.emobit.backend.db.ElderStateEntity
import com.emobit.backend.db.EventEntity
import com.emobit.backend.db.LocalClientSettingEntity
import com.emobit.backend.db.LocalElderProfileEntity
import com.emobit.backend.db.LocalGuardianContactEntity
import com.emobit.backend.db.LocalMedicationCacheEntity
import com.emobit.backend.db.LocalSyncStateEntity
import com.emobit.backend.db.MediaEntity
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.security.MessageDigest
import java.time.Instant
import java.time.format.DateTimeFormatter
import java.util.UUID

class Storage(private val context: Context) {
    private val db: AppDb = Room.databaseBuilder(context, AppDb::class.java, "emobit.db")
        .fallbackToDestructiveMigration()
        .build()

    private val uploadsRoot: File = File(context.filesDir, "uploads")

    suspend fun getOrInitElderState(elderId: String): String {
        val existing = db.elderDao().getElderState(elderId)
        if (existing != null) return existing.stateJson

        val now = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
        val defaultJson = defaultElderStateJson(now)
        db.elderDao().upsertElderState(
            ElderStateEntity(
                elderId = elderId,
                updatedAt = now,
                stateJson = defaultJson,
            ),
        )
        cacheLocalProjection(elderId, defaultJson, now)
        return defaultJson
    }

    suspend fun upsertElderState(elderId: String, stateJson: String) {
        val now = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
        db.elderDao().upsertElderState(
            ElderStateEntity(
                elderId = elderId,
                updatedAt = now,
                stateJson = stateJson,
            ),
        )
        cacheLocalProjection(elderId, stateJson, now)
    }

    suspend fun appendEvent(
        elderId: String,
        type: String,
        timestampMs: Long,
        payloadJson: String,
        maxKeep: Int,
    ): EventEntity {
        val eventId = UUID.randomUUID().toString()
        val entity = EventEntity(
            eventId = eventId,
            elderId = elderId,
            type = type,
            timestampMs = timestampMs,
            payloadJson = payloadJson,
        )
        db.eventDao().insertEvent(entity)
        val count = db.eventDao().countForElder(elderId)
        if (count > maxKeep) {
            db.eventDao().trimToKeepNewest(elderId, maxKeep)
        }
        return entity
    }

    suspend fun saveMedia(
        elderId: String,
        type: String,
        filename: String,
        mimeType: String,
        bytes: ByteArray,
    ): MediaEntity {
        val ext = extensionFromFilenameOrMime(filename, mimeType)
        val hash = sha256(bytes).take(20)
        val storedName = "$hash$ext"
        val relativePath = "$elderId/$type/$storedName"
        val targetFile = File(uploadsRoot, relativePath)
        targetFile.parentFile?.mkdirs()
        targetFile.writeBytes(bytes)

        val mediaId = relativePath
        val createdAt = DateTimeFormatter.ISO_INSTANT.format(Instant.now())
        val entity = MediaEntity(
            mediaId = mediaId,
            elderId = elderId,
            type = type,
            filename = filename,
            mimeType = mimeType.lowercase(),
            sizeBytes = bytes.size.toLong(),
            relativePath = relativePath,
            createdAt = createdAt,
        )
        db.mediaDao().upsertMedia(entity)
        return entity
    }

    suspend fun resolveMediaFile(mediaId: String): File? {
        val normalized = mediaId.trim().removePrefix("/")
        val entity = db.mediaDao().getByMediaId(normalized) ?: return null
        val file = File(uploadsRoot, entity.relativePath)
        return if (file.exists()) file else null
    }

    fun describe(): String {
        return buildString {
            appendLine("- SQLite DB: ${context.getDatabasePath("emobit.db").absolutePath}")
            appendLine("- Uploads: ${uploadsRoot.absolutePath}")
        }
    }

    private fun defaultElderStateJson(nowIso: String): String {
        // Minimal default that matches the web Data Backend shape closely enough for demos.
        return """
            {
              "version": 1,
              "updatedAt": ${jsonString(nowIso)},
              "profile": null,
              "guardianContacts": [],
              "memoryAnchors": [],
              "memoryEvents": [],
              "wanderingConfig": { "homeLocation": null, "safeZones": [] },
              "wandering": { "state": null, "events": [] },
              "medications": [],
              "medicationLogs": [],
              "medicationEvents": [],
              "activeReminder": null,
              "health": { "metrics": null, "alerts": [] },
              "cognitive": { "conversations": [], "assessments": [], "reports": [] },
              "carePlan": { "items": [], "events": [], "trend": null },
              "locationAutomation": { "state": null, "events": [] },
              "appShell": { "activeView": "dashboard", "simulation": "NONE", "systemStatus": "NORMAL", "elderMessage": null, "elderAction": null, "updatedAt": ${jsonString(nowIso)} },
              "faces": [],
              "faceEvents": [],
              "timeAlbum": [],
              "sundowning": { "snapshot": null, "alerts": [], "interventions": [] },
              "events": [],
              "outbound": [],
              "outboundEvents": [],
              "uiCommands": []
            }
        """.trimIndent()
    }

    private fun jsonString(value: String): String = "\"" + value.replace("\"", "\\\"") + "\""

    private suspend fun cacheLocalProjection(elderId: String, stateJson: String, updatedAt: String) {
        val state = parseJsonObjectOrNull(stateJson) ?: JsonObject(emptyMap())
        val profile = state["profile"] as? JsonObject ?: JsonObject(emptyMap())

        db.localProjectionDao().upsertElderProfile(
            LocalElderProfileEntity(
                elderId = elderId,
                name = profile.stringOrNull("name"),
                nickname = profile.stringOrNull("nickname"),
                age = profile["age"]?.jsonPrimitive?.intOrNull,
                gender = profile.stringOrNull("gender"),
                homeAddress = profile.stringOrNull("homeAddress"),
                profileJson = Json.encodeToString(JsonObject.serializer(), profile),
                updatedAt = updatedAt,
                syncStatus = "synced",
            ),
        )

        val guardianContacts = (state["guardianContacts"] as? JsonArray)
            ?.mapIndexed { index, item ->
                val contact = item as? JsonObject ?: JsonObject(emptyMap())
                LocalGuardianContactEntity(
                    elderId = elderId,
                    contactId = contact.stringOrNull("id") ?: "guardian_$index",
                    name = contact.stringOrNull("name"),
                    relation = contact.stringOrNull("relation"),
                    phone = contact.stringOrNull("phone"),
                    channel = contact.stringOrNull("channel"),
                    target = contact.stringOrNull("target"),
                    priority = contact["priority"]?.jsonPrimitive?.intOrNull,
                    notificationEnabled = contact["notificationEnabled"]?.jsonPrimitive?.contentOrNull != "false",
                    settingsJson = Json.encodeToString(JsonElement.serializer(), item),
                    updatedAt = updatedAt,
                )
            }
            ?: emptyList()
        db.localProjectionDao().replaceGuardianContacts(elderId, guardianContacts)

        val medications = (state["medications"] as? JsonArray)
            ?.mapIndexed { index, item ->
                val medication = item as? JsonObject ?: JsonObject(emptyMap())
                LocalMedicationCacheEntity(
                    elderId = elderId,
                    medicationId = medication.stringOrNull("id") ?: "medication_$index",
                    name = medication.stringOrNull("name"),
                    dosage = medication.stringOrNull("dosage"),
                    frequency = medication.stringOrNull("frequency"),
                    timesJson = Json.encodeToString(JsonElement.serializer(), medication["times"] ?: JsonArray(emptyList())),
                    instructions = medication.stringOrNull("instructions"),
                    purpose = medication.stringOrNull("purpose"),
                    imageUrl = medication.stringOrNull("imageUrl"),
                    medicationJson = Json.encodeToString(JsonElement.serializer(), item),
                    updatedAt = updatedAt,
                )
            }
            ?: emptyList()
        db.localProjectionDao().replaceMedications(elderId, medications)

        val appShell = state["appShell"] as? JsonObject ?: JsonObject(emptyMap())
        db.localProjectionDao().upsertClientSetting(
            LocalClientSettingEntity(
                elderId = elderId,
                clientRole = "elder",
                settingKey = "appShell",
                valueJson = Json.encodeToString(JsonObject.serializer(), appShell),
                updatedAt = updatedAt,
                dirty = false,
            ),
        )
        db.localProjectionDao().upsertSyncState(
            LocalSyncStateEntity(
                elderId = elderId,
                scope = "elder_state",
                remoteUpdatedAt = state.stringOrNull("updatedAt"),
                localUpdatedAt = updatedAt,
                pendingChangesJson = "[]",
            ),
        )
    }
}

private fun JsonObject.stringOrNull(key: String): String? {
    return this[key]?.jsonPrimitive?.contentOrNull?.takeIf { it.isNotBlank() }
}

private fun parseJsonObjectOrNull(text: String): JsonObject? {
    return try {
        Json.parseToJsonElement(text) as? JsonObject
    } catch (_: Exception) {
        null
    }
}

private fun sha256(bytes: ByteArray): String {
    val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
    return digest.joinToString("") { "%02x".format(it) }
}

private fun extensionFromFilenameOrMime(filename: String, mimeType: String): String {
    val lower = filename.lowercase()
    val dot = lower.lastIndexOf('.')
    if (dot >= 0 && dot < lower.length - 1) {
        val ext = lower.substring(dot)
        if (Regex("^\\.[a-z0-9]{1,10}$").matches(ext)) return ext
    }
    return when (mimeType.lowercase()) {
        "image/jpeg", "image/jpg" -> ".jpg"
        "image/png" -> ".png"
        "image/webp" -> ".webp"
        "image/gif" -> ".gif"
        "audio/mpeg" -> ".mp3"
        "audio/wav" -> ".wav"
        else -> ".bin"
    }
}
