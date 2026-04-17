import unittest

from app import app


class EcgPredictApiTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_predict_returns_ecg_model_result(self):
        response = self.client.post(
            '/predict',
            json={
                'Age': 40,
                'Sex': 'M',
                'ChestPainType': 'ATA',
                'RestingBP': 140,
                'Cholesterol': 289,
                'FastingBS': 0,
                'RestingECG': 'Normal',
                'MaxHR': 172,
                'ExerciseAngina': 'N',
                'Oldpeak': 0.0,
                'ST_Slope': 'Up',
            },
        )

        self.assertEqual(response.status_code, 200)
        payload = response.get_json()
        self.assertIsInstance(payload, dict)
        self.assertIn(payload.get('status'), {'Normal', 'Critical'})
        self.assertIn(payload.get('risk'), {'Low', 'High'})
        self.assertIn('confidence', payload)

    def test_predict_requires_all_ecg_fields(self):
        response = self.client.post(
            '/predict',
            json={
                'Age': 40,
                'Sex': 'M',
            },
        )

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertIsInstance(payload, dict)
        self.assertEqual(payload.get('error'), 'Invalid input')


if __name__ == '__main__':
    unittest.main()
