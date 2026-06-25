import asyncio
import asyncpg

async def check_db():
    conn = await asyncpg.connect('postgresql://postgres:Pan02da%23Pcmb@db.kkmptisqtujpzlimqfyr.supabase.co:5432/postgres')
    rows = await conn.fetch("SELECT pid, state, query FROM pg_stat_activity WHERE usename = 'postgres';")
    for row in rows:
        print(dict(row))
    await conn.close()

asyncio.run(check_db())
