import path from 'node:path';

import dotenv from 'dotenv';

import { PostgresDataStore } from '../backend/data-server/postgresStore.mjs';

dotenv.config({ path: path.join(process.cwd(), '.env') });
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

async function main() {
    const store = new PostgresDataStore({
        rootDir: process.env.EMOBIT_DATA_SERVER_ROOT || path.join(process.cwd(), 'backend', 'data-server', 'data'),
        legacyStatePath: process.env.EMOBIT_DATA_SERVER_LEGACY_STATE_PATH || path.join(process.cwd(), 'backend', 'bridge', 'data', 'state.json'),
        publicBaseUrl: process.env.EMOBIT_DATA_SERVER_PUBLIC_BASE_URL || '',
        defaultElderId: process.env.EMOBIT_ELDER_ID || 'elder_demo',
    });

    await store.initialize();
    const elderIds = await store.listElders();
    console.log(`[EmoBitMigration] Migrated ${elderIds.length} elder record(s) into PostgreSQL.`);
    for (const elderId of elderIds) {
        console.log(`- ${elderId}`);
    }
    await store.close();
}

main().catch((error) => {
    console.error('[EmoBitMigration] Failed:', error);
    process.exitCode = 1;
});
