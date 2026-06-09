# Email Setup and Troubleshooting

## Issue: IP Address Changing Repeatedly

When using Vercel for deployment, you may notice that IP addresses change frequently. This is normal behavior and is caused by Vercel's distributed infrastructure.

### Why IP Addresses Change

1. **Vercel's Distributed Infrastructure**: Vercel uses multiple servers across different regions
2. **Load Balancing**: Requests are routed through different servers based on availability
3. **Auto-scaling**: New servers are spun up and down based on traffic
4. **Edge Network**: Vercel's edge network caches and serves content from various locations

### This is Normal - Here's Why It's Not a Problem

- Brevo (Sendinblue) is designed to handle requests from multiple IP addresses
- The API key authentication is sufficient for security
- IP changes don't affect email delivery functionality

### How We've Fixed the Issue

1. **Consistent API Usage**: Switched from direct fetch calls to official Brevo SDK
2. **Better Error Handling**: Added specific handling for IP-related errors
3. **Enhanced Logging**: Added detailed logging for debugging
4. **Environment Configuration**: Proper setup of environment variables

### Configuration Requirements

Make sure your `.env` file has these settings:

```env
BREVO_API_KEY=your_brevo_api_key_here
BREVO_SENDER_EMAIL=noreply@iiecs.edu
BREVO_SENDER_NAME=IIECS Admin
BREVO_EMAIL_LOGO_URL=https://lrrzzcvaufvodwsjxuph.supabase.co/storage/v1/object/public/id-cards/logo-bot.jpeg
```

### Important Notes

1. **Verified Sender Email**: The `BREVO_SENDER_EMAIL` must be verified in your Brevo account
2. **API Key Security**: Keep your API key secure and never commit it to version control
3. **Rate Limits**: Be aware of Brevo's sending limits to avoid being blocked

### Troubleshooting Steps

If you encounter email sending issues:

1. **Check Logs**: Look for `[InvoiceEmail]` logs in your console
2. **Verify API Key**: Ensure `BREVO_API_KEY` is set correctly
3. **Test Connection**: Run the test script: `npm run test:brevo`
4. **Check Brevo Dashboard**: Monitor your Brevo account for any issues

### Vercel Specific Configuration

If you're still experiencing issues, you may need to:

1. **Add IP Allowlist**: In Brevo, add your deployment IPs (though this is not recommended due to dynamic nature)
2. **Use Dedicated IPs**: Consider Vercel's dedicated IP feature
3. **Configure Headers**: Add custom headers for better tracking

### Testing Email Functionality

Use the test script to verify email sending:

```bash
cd scripts
npm run test:brevo
```

This will send a test email and help verify everything is working correctly.

### Summary

The IP address changes are normal and expected when using Vercel. The key is to:
- Use the official Brevo SDK
- Properly configure environment variables
- Handle errors gracefully
- Monitor logs for debugging

The email system should now work reliably despite the IP address changes.