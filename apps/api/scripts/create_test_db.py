import asyncio
import asyncpg

async def main():
    conn = await asyncpg.connect("postgresql://postgres:postgres@localhost:5432/postgres")
    row = await conn.fetchrow("SELECT 1 FROM pg_database WHERE datname='skin_analysis_test'")
    if not row:
        await conn.execute("CREATE DATABASE skin_analysis_test;")
        print("Created database skin_analysis_test")
    else:
        print("Database skin_analysis_test already exists")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
