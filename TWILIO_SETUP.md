# Smart Healthcare Backend - Twilio Setup Guide

## 📋 Prerequisites

You need a Twilio account to enable SMS alerts. Get one at: https://www.twilio.com/console

## 🔑 Setting Up Twilio Credentials

### 1. Get Your Twilio Credentials

1. Go to [Twilio Console](https://www.twilio.com/console)
2. Find your **Account SID** (starts with `AC`)
3. Find your **Auth Token** (keep this secret!)
4. Get your Twilio phone number (starts with `+1` or your country code)

### 2. Setup Environment Variables

Copy `.env.example` to `.env` and fill in your actual credentials:

```bash
# Copy the template
cp .env.example .env
```

Edit `.env` with your Twilio details:

```env
# Twilio SMS Configuration - ADD YOUR REAL CREDENTIALS HERE
TWILIO_ACCOUNT_SID=AC1234567890abcdef1234567890abcdef
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_FROM=+1234567890        # Your Twilio phone number
PATIENT_PHONE=+19876543210           # Patient's phone number to receive alerts

# Keep other configs as needed...
```

### 3. Security Notes

⚠️ **IMPORTANT:**
- **Never commit `.env`** - it contains sensitive credentials
- The `.gitignore` file already excludes `.env`
- Always use `.env.example` as a template for sharing with others
- Treat your `TWILIO_AUTH_TOKEN` like a password

### 4. Testing SMS Alerts

Once configured, SMS alerts will automatically trigger when a "Critical" health condition is detected:

- Heart Rate > 120 bpm
- SpO2 < 90%
- Temperature > 39°C

You'll see in the console:
```
✅ SMS sent successfully! Message SID: SM1234567890abcdef1234567890abcdef
```

Or if not configured:
```
⚠️ Twilio not configured. SMS not sent. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env
```

### 5. Optional: Email Alerts

To also enable email alerts, configure these in `.env`:

```env
EMAIL_SENDER=your_email@gmail.com
EMAIL_PASSWORD=your_app_specific_password  # Use Gmail App Password, not your main password
EMAIL_RECEIVER=alert@example.com
```

## 📱 How It Works

1. The `/predict` endpoint analyzes patient vital signs
2. If prediction is "Critical", automatically sends SMS alert
3. SMS includes: prediction, heart rate, SpO2, temperature
4. Uses Twilio API to deliver the message

## ✅ Verification Checklist

- [ ] Twilio account created
- [ ] Account SID copied to `.env`
- [ ] Auth Token copied to `.env`  
- [ ] Twilio phone number set in `.env`
- [ ] Patient phone number set in `.env`
- [ ] `.env` is in `.gitignore` (shouldn't be committed)
- [ ] Tested with `/predict` endpoint

## 🆘 Troubleshooting

**"Twilio not configured" error?**
- Check `.env` file exists in project root
- Verify `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are set
- Restart the Flask server after editing `.env`

**SMS not sending?**
- Verify phone numbers include country code (e.g., `+1234567890`)
- Check Twilio account has credits
- Review server logs for error details

**"python-dotenv not installed"?**
```bash
pip install python-dotenv
```
