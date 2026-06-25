import asyncio
import asyncpg
import sys

async def test():
    try:
        conn = await asyncpg.connect('postgresql://postgres:Pan02da%23Pcmb@db.kkmptisqtujpzlimqfyr.supabase.co:5432/postgres', timeout=10)
        print("Connected to Supabase successfully!")
        await conn.close()
    except Exception as e:
        print(f"Connection failed: {e}")
        sys.exit(1)

asyncio.run(test())
