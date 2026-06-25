import asyncio
import asyncpg

async def add_column():
    conn = await asyncpg.connect('postgresql://postgres:Pan02da%23Pcmb@db.kkmptisqtujpzlimqfyr.supabase.co:5432/postgres')
    await conn.execute('ALTER TABLE skincare_routine_current ADD COLUMN IF NOT EXISTS uses_nothing BOOLEAN NOT NULL DEFAULT FALSE')
    print("Column added!")
    await conn.close()

asyncio.run(add_column())
