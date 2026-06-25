import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select
from app.core.config import settings
from app.models.user import User
from app.routers.progress import get_progress_summary

async def main():
    engine = create_async_engine(str(settings.database_url).replace("postgresql://", "postgresql+asyncpg://"))
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)
    
    async with SessionLocal() as db:
        # get first user
        result = await db.execute(select(User).limit(1))
        user = result.scalar_one_or_none()
        if not user:
            print("No user found")
            return
            
        print(f"Testing summary for user: {user.id}")
        try:
            summary = await get_progress_summary(db=db, current_user=user)
            print("Summary loaded successfully!")
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
