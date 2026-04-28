package com.emobit.backend.db

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "elder_state",
)
data class ElderStateEntity(
    @PrimaryKey val elderId: String,
    val updatedAt: String,
    val stateJson: String,
)

@Entity(
    tableName = "events",
    indices = [
        Index(value = ["elderId"]),
        Index(value = ["elderId", "timestampMs"]),
        Index(value = ["eventId"], unique = true),
    ],
)
data class EventEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val eventId: String,
    val elderId: String,
    val type: String,
    val timestampMs: Long,
    val payloadJson: String,
)

@Entity(
    tableName = "media",
    indices = [
        Index(value = ["elderId"]),
        Index(value = ["mediaId"], unique = true),
    ],
)
data class MediaEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val mediaId: String,
    val elderId: String,
    val type: String,
    val filename: String,
    val mimeType: String,
    val sizeBytes: Long,
    val relativePath: String,
    val createdAt: String,
)

@Entity(
    tableName = "local_elder_profiles",
)
data class LocalElderProfileEntity(
    @PrimaryKey val elderId: String,
    val name: String?,
    val nickname: String?,
    val age: Int?,
    val gender: String?,
    val homeAddress: String?,
    val profileJson: String,
    val updatedAt: String,
    val syncStatus: String,
)

@Entity(
    tableName = "local_guardian_contacts",
    primaryKeys = ["elderId", "contactId"],
    indices = [
        Index(value = ["elderId"]),
        Index(value = ["elderId", "priority"]),
    ],
)
data class LocalGuardianContactEntity(
    val elderId: String,
    val contactId: String,
    val name: String?,
    val relation: String?,
    val phone: String?,
    val channel: String?,
    val target: String?,
    val priority: Int?,
    val notificationEnabled: Boolean,
    val settingsJson: String,
    val updatedAt: String,
)

@Entity(
    tableName = "local_medication_cache",
    primaryKeys = ["elderId", "medicationId"],
    indices = [
        Index(value = ["elderId"]),
    ],
)
data class LocalMedicationCacheEntity(
    val elderId: String,
    val medicationId: String,
    val name: String?,
    val dosage: String?,
    val frequency: String?,
    val timesJson: String,
    val instructions: String?,
    val purpose: String?,
    val imageUrl: String?,
    val medicationJson: String,
    val updatedAt: String,
)

@Entity(
    tableName = "local_client_settings",
    primaryKeys = ["elderId", "clientRole", "settingKey"],
    indices = [
        Index(value = ["elderId", "clientRole"]),
    ],
)
data class LocalClientSettingEntity(
    val elderId: String,
    val clientRole: String,
    val settingKey: String,
    val valueJson: String,
    val updatedAt: String,
    val dirty: Boolean,
)

@Entity(
    tableName = "local_sync_state",
    primaryKeys = ["elderId", "scope"],
)
data class LocalSyncStateEntity(
    val elderId: String,
    val scope: String,
    val remoteUpdatedAt: String?,
    val localUpdatedAt: String,
    val pendingChangesJson: String,
)
