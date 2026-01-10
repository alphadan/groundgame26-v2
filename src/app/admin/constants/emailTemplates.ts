// src/app/admin/constants/emailTemplates.ts

export interface WelcomeEmailData {
  display_name: string;
  preferred_name: string;
  email: string;
  tempPassword: string;
  created_by: string; // The Name of the Area/County Chair
}

export const getWelcomeEmailTemplate = (data: WelcomeEmailData) => {
  const loginUrl = `https://groundgame26.com?email=${encodeURIComponent(
    data.email
  )}`;

  return {
    subject: `${data.created_by} has invited you to the GroundGame26 app`,
    body: `
Dear ${data.preferred_name},

${data.created_by} has invited you to use the GroundGame26 app.

GroundGame26 is a Republican Get Out The Vote app for Chester County. The app has high security features, so there's a quick verification process on your first login.

To get started, here's a simple step-by-step guide to set up your account:

1. Visit the portal: ${loginUrl}
2. Enter your email (${data.email}) and the temporary password: ${data.tempPassword}
3. A pop-up will ask for your mobile phone number. You will also be asked to confirm your email address. (You may be asked to complete a RECAPTCHA to prevent bot attacks.)
4. Check your email inbox for a message from GroundGame26 and click on the "Verify" link. (PLEASE CHECK YOUR SPAM FOLDER).
5. The link will bring you to a secure page. Enter a new password (minimum 8 characters) and submit. Your account is now secure; we never have access to your password.
6. Return to groundgame26.com and log in with your email and your NEW password.
7. A popup will ask for your cell phone number. Enter your mobile number and click ‘Verify’. You will be texted a six-digit code.
8. Enter the six-digit code and submit.

That's it! Once logged in, you'll have access to voter data and analysis for your area. If you run into any issues during setup, please reply to this email for support.

As a Republican Committeeperson, you're exactly the type of user I've built this app for. It's currently in beta testing, so while it's functional and secure, you may notice some areas where improvements are needed. I'm excited to hear your feedback and feature requests — your knowledge and experience would be invaluable in helping us refine it.

Welcome to GroundGame26 — looking forward to your thoughts!

Best regards,

${data.created_by}
On behalf of Dan Keane (Developer, GroundGame26)
Support: admin@groundgame26.com
    `.trim(),
  };
};
