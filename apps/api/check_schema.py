import asyncio
import asyncpg

async def check_schema():
    conn = await asyncpg.connect('postgresql://postgres:Pan02da%23Pcmb@db.kkmptisqtujpzlimqfyr.supabase.co:5432/postgres')
    rows = await conn.fetch("""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'questionnaire_responses';
    """)
    if not rows:
        print("Table not found!")
    else:
        for row in rows:
            print(row['column_name'], row['data_type'])
    await conn.close()

asyncio.run(check_schema())
