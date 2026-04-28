package com.emobit.backend.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update

@Dao
interface ElderDao {
    @Query("SELECT * FROM elder_state WHERE elderId = :elderId LIMIT 1")
    suspend fun getElderState(elderId: String): ElderStateEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertElderState(entity: ElderStateEntity)
}

@Dao
interface EventDao {
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertEvent(entity: EventEntity): Long

    @Query("SELECT COUNT(*) FROM events WHERE elderId = :elderId")
    suspend fun countForElder(elderId: String): Long

    @Query("DELETE FROM events WHERE id IN (SELECT id FROM events WHERE elderId = :elderId ORDER BY timestampMs DESC LIMIT -1 OFFSET :keep)")
    suspend fun trimToKeepNewest(elderId: String, keep: Int)
}

@Dao
interface MediaDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMedia(entity: MediaEntity)

    @Query("SELECT * FROM media WHERE mediaId = :mediaId LIMIT 1")
    suspend fun getByMediaId(mediaId: String): MediaEntity?
}

@Dao
interface LocalProjectionDao {
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertElderProfile(entity: LocalElderProfileEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertGuardianContacts(entities: List<LocalGuardianContactEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertMedications(entities: List<LocalMedicationCacheEntity>)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertClientSetting(entity: LocalClientSettingEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun upsertSyncState(entity: LocalSyncStateEntity)

    @Query("DELETE FROM local_guardian_contacts WHERE elderId = :elderId")
    suspend fun deleteGuardianContacts(elderId: String)

    @Query("DELETE FROM local_medication_cache WHERE elderId = :elderId")
    suspend fun deleteMedications(elderId: String)

    @Transaction
    suspend fun replaceGuardianContacts(elderId: String, entities: List<LocalGuardianContactEntity>) {
        deleteGuardianContacts(elderId)
        if (entities.isNotEmpty()) upsertGuardianContacts(entities)
    }

    @Transaction
    suspend fun replaceMedications(elderId: String, entities: List<LocalMedicationCacheEntity>) {
        deleteMedications(elderId)
        if (entities.isNotEmpty()) upsertMedications(entities)
    }
}
