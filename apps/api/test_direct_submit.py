import asyncio
import httpx
from datetime import timedelta
import sys
import os

# Add apps/api to path so we can import app modules
sys.path.append(os.path.abspath("."))

from app.core.security import create_access_token

async def test_api():
    base_url = "http://localhost:8001/api/v1"
    
    import asyncpg
    conn = await asyncpg.connect('postgresql://postgres:Pan02da%23Pcmb@db.kkmptisqtujpzlimqfyr.supabase.co:5432/postgres')
    # Get any verified user
    user = await conn.fetchrow("SELECT id, role, email FROM users WHERE is_verified = true LIMIT 1")
    await conn.close()
    
    if not user:
        print("No verified user found!")
        return

    user_id = str(user['id'])
    role = user['role']
    email = user['email']
    print(f"Testing with user_id: {user_id}")
    
    token, _ = create_access_token(user_id=user_id, role=role, email=email)

    async with httpx.AsyncClient(timeout=30.0) as client:
        headers = {"Authorization": f"Bearer {token}"}
        payload = {
            "sleep_hours_avg": 7,
            "sleep_quality": 3,
            "sleep_consistency": True,
            "water_intake_liters": 2.0,
            "diet_type": "mixed",
            "sugar_consumption": "moderate",
            "dairy_consumption": "sometimes",
            "stress_level": 3,
            "stress_source": ["work"],
            "exercise_frequency": "none",
            "screen_time_hours": 8,
            "work_environment": "mixed",
            "pollution_exposure": "metro",
            "city": "Mumbai",
            "water_hardness": "moderate",
            "routine_steps": ["cleanser"],
            "cleanser_frequency": "morning_night",
            "sunscreen_use": "yes_always",
            "diagnosed_conditions": ["none"],
            "medication_affects_skin": False,
            "alcohol_consumption": "never",
            "smoking_status": "never"
        }
        submit_res = await client.post(f"{base_url}/questionnaire/submit", json=payload, headers=headers)
        print("Submit:", submit_res.status_code, submit_res.text)

asyncio.run(test_api())
