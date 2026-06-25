import asyncio
import httpx
import uuid

async def test_api():
    base_url = "http://localhost:8000/api/v1"
    random_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    async with httpx.AsyncClient() as client:
        # Register user
        reg_res = await client.post(f"{base_url}/auth/register/user", json={
            "email": random_email,
            "password": "Password123!",
            "full_name": "Test User"
        })
        print("Register:", reg_res.status_code, reg_res.text)

        # Login
        login_res = await client.post(f"{base_url}/auth/login", json={
            "email": random_email,
            "password": "Password123!"
        })
        print("Login:", login_res.status_code, login_res.text)
        
        if login_res.status_code != 200:
            print("Login failed, stopping.")
            return

        token = login_res.json()["access_token"]

        import asyncpg
        conn = await asyncpg.connect('postgresql://postgres:Pan02da%23Pcmb@db.kkmptisqtujpzlimqfyr.supabase.co:5432/postgres')
        await conn.execute("UPDATE users SET is_verified = true WHERE email = $1", random_email)
        await conn.close()

        # Submit questionnaire
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
