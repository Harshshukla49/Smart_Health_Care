import unittest

from app import app


class PredictApiTestCase(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()

    def test_predict_returns_normal_for_safe_vitals(self):
        response = self.client.post(
            '/predict',
            json={
                'heart_rate': 82,
                'spo2': 98,
                'temperature': 36.8,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'status': 'Normal'})

    def test_predict_returns_critical_for_extreme_vitals(self):
        response = self.client.post(
            '/predict',
            json={
                'heart_rate': 168,
                'spo2': 84,
                'temperature': 40.2,
            },
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), {'status': 'Critical'})

    def test_predict_requires_valid_json(self):
        response = self.client.post('/predict', data='not-json', content_type='text/plain')

        self.assertEqual(response.status_code, 400)
        payload = response.get_json()
        self.assertIsInstance(payload, dict)
        self.assertEqual(payload.get('error'), 'Invalid input')


if __name__ == '__main__':
    unittest.main()
