// src/app/admin/constants/emailTemplates.ts
export interface WelcomeEmailData {
  display_name: string;
  preferred_name: string;
  email: string;
  tempPassword: string;
  created_by: string;
}

export const getWelcomeEmailTemplate = (data: WelcomeEmailData) => {
  const loginUrl = `https://groundgame26.com?email=${encodeURIComponent(data.email)}`;

  return {
    subject: `Action Required: Your GroundGame26 account is ready`,
    body: `
Dear ${data.preferred_name || data.display_name},

${data.created_by} has created your official GroundGame26 account. Our mission is to provide you with the best localized voter data to help Republicans win in Chester County.

Because your security is our priority, your account is pre-protected with two-factor authentication.

How to log in for the first time:

1. Click here to open the app: ${loginUrl}
2. Enter your temporary password: ${data.tempPassword}
3. Check your phone: You will immediately receive a 6-digit security code via text message. Enter that code into the app.
4. Create your private password: You will be asked to choose a new password that only you know.

That's it! Once you've set your private password, you will have full access to your precinct maps, voter lists, and campaign resources.

Login Tips:
• Use your mobile phone or a modern tablet for the best experience.
• Ensure you have cell service to receive your one-time security code.

If you have any questions or need a hand getting started, simply reply to this email. We are here to support you!

Best regards,

${data.created_by}
GroundGame26 Campaign Team
Support: admin@groundgame26.com
    `.trim(),
  };
};
