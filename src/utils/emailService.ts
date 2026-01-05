import nodemailer from 'nodemailer';

const emailService = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // Add timeouts and optimization
  connectionTimeout: 10000, // 10 seconds
  greetingTimeout: 5000,    // 5 seconds
  socketTimeout: 15000,     // 15 seconds
  pool: true,               // Use connection pooling
  maxConnections: 5,        // Max simultaneous connections
  maxMessages: 100,         // Max messages per connection
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Retry logic for email sending
const sendEmailWithRetry = async (options: SendEmailOptions, retries = 2): Promise<boolean> => {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await emailService.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        ...options,
      });
      console.log(`✓ Email sent successfully to ${options.to}${attempt > 0 ? ` (attempt ${attempt + 1})` : ''}`);
      return true;
    } catch (error: any) {
      console.error(`✗ Email attempt ${attempt + 1} failed:`, error.message);
      
      // If it's the last attempt or a non-retryable error, fail
      if (attempt === retries || error.code === 'EAUTH') {
        console.error('Failed to send email after all retries:', error);
        return false;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
    }
  }
  return false;
};

export const sendEmail = async (options: SendEmailOptions): Promise<boolean> => {
  return sendEmailWithRetry(options);
};

export const sendOtpEmail = async (email: string, otp: string, name?: string): Promise<boolean> => {
  const subject = 'Your Email Verification OTP - Six Loans';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0d9488; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .otp-box { background-color: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; border: 2px solid #0d9488; }
        .otp-code { font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }
        .warning { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Email Verification</h1>
        </div>
        
        <div class="content">
          <p>Hello ${name || 'User'},</p>
          
          <p>Thank you for registering with Six Loans. To complete your email verification, please use the following One-Time Password (OTP):</p>
          
          <div class="otp-box">
            <p>Your OTP Code:</p>
            <div class="otp-code">${otp}</div>
          </div>
          
          <p><strong>This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</strong></p>
          
          <p><span class="warning">⚠️ Important:</span></p>
          <ul>
            <li>Never share this OTP with anyone</li>
            <li>Our team will never ask for your OTP</li>
            <li>If you didn't request this verification, please ignore this email</li>
          </ul>
          
          <p>If you need any assistance, please contact our support team.</p>
          
          <p>Best regards,<br><strong>Six Loans Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; 2026 Six Loans. All rights reserved.</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Your OTP code is: ${otp}. This code will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Never share this OTP with anyone.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};

export const sendPasswordResetOtpEmail = async (email: string, otp: string, name?: string): Promise<boolean> => {
  const subject = 'Password Reset OTP - Six Loans';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0d9488; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .otp-box { background-color: white; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; border: 2px solid #0d9488; }
        .otp-code { font-size: 32px; font-weight: bold; color: #0d9488; letter-spacing: 5px; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }
        .warning { color: #dc2626; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Password Reset Request</h1>
        </div>
        
        <div class="content">
          <p>Hello ${name || 'User'},</p>
          
          <p>We received a request to reset your password for your Six Loans account. Please use the following One-Time Password (OTP) to proceed:</p>
          
          <div class="otp-box">
            <p>Your OTP Code:</p>
            <div class="otp-code">${otp}</div>
          </div>
          
          <p><strong>This OTP will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes.</strong></p>
          
          <p><span class="warning">⚠️ Security Notice:</span></p>
          <ul>
            <li>If you did not request a password reset, please ignore this email and secure your account</li>
            <li>Never share this OTP with anyone, including Six Loans staff</li>
            <li>Contact support immediately if you suspect unauthorized access</li>
          </ul>
          
          <p>Best regards,<br><strong>Six Loans Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; 2026 Six Loans. All rights reserved.</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Password Reset OTP: ${otp}. This code will expire in ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. If you didn't request this, please ignore.`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};

export const sendWelcomeEmail = async (email: string, name: string): Promise<boolean> => {
  const subject = 'Welcome to Six Loans! 🎉';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .feature-box { background-color: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #0d9488; }
        .cta-button { background-color: #0d9488; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }
        .emoji { font-size: 24px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Welcome to Six Loans!</h1>
          <p style="margin: 0; font-size: 18px;">Your Financial Journey Starts Here</p>
        </div>
        
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Congratulations! Your Six Loans account has been successfully created. We're thrilled to have you join our community of smart borrowers.</p>
          
          <h3 style="color: #0d9488;">✨ What's Next?</h3>
          
          <div class="feature-box">
            <strong>📝 Complete Your Profile</strong><br>
            Add your personal and employment details for a smoother loan application process. A complete profile increases your chances of approval!
          </div>
          
          <div class="feature-box">
            <strong>🔍 Explore Loan Options</strong><br>
            Browse through our wide range of loan products including Personal Loans, Business Loans, Home Loans, and more.
          </div>
          
          <div class="feature-box">
            <strong>💳 Check Credit Cards</strong><br>
            Discover credit cards tailored to your needs with exclusive benefits and rewards.
          </div>
          
          <div class="feature-box">
            <strong>🛡️ Insurance Products</strong><br>
            Protect what matters most with our comprehensive insurance solutions.
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/profile" class="cta-button">
              Complete Your Profile Now →
            </a>
          </div>
          
          <h3 style="color: #0d9488;">🌟 Why Choose Six Loans?</h3>
          <ul>
            <li><strong>Zero Platform Fee</strong> - We don't charge you for using our service</li>
            <li><strong>Quick Approval</strong> - Get instant decisions on your applications</li>
            <li><strong>Best Rates</strong> - Compare offers from multiple lenders</li>
            <li><strong>24/7 Support</strong> - Our team is always here to help</li>
          </ul>
          
          <p>If you have any questions or need assistance, feel free to reach out to our support team anytime.</p>
          
          <p>Best regards,<br><strong>The Six Loans Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; 2026 Six Loans. All rights reserved.</p>
          <p>📧 support@sixloans.com | 📞 1800-XXX-XXXX</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Welcome to Six Loans, ${name}! Your account has been created successfully. Complete your profile to start applying for loans. Visit: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/profile`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};

export const sendApplicationConfirmationEmail = async (
  email: string, 
  name: string, 
  productName: string,
  productType: string,
  referenceNo: string
): Promise<boolean> => {
  const subject = `Application Received - ${productName} | Ref: ${referenceNo}`;
  
  const productEmoji = productType === 'LOAN' ? '💰' : productType === 'CREDIT_CARD' ? '💳' : '🛡️';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 30px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
        .info-box { background-color: white; padding: 20px; margin: 20px 0; border-radius: 5px; border: 1px solid #e5e7eb; }
        .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
        .info-label { font-weight: bold; color: #6b7280; }
        .info-value { color: #0d9488; font-weight: bold; }
        .status-badge { background-color: #fef3c7; color: #92400e; padding: 8px 15px; border-radius: 20px; display: inline-block; font-weight: bold; }
        .timeline { margin: 20px 0; }
        .timeline-item { padding: 15px; margin: 10px 0; background-color: white; border-radius: 5px; border-left: 4px solid #0d9488; }
        .footer { background-color: #f3f4f6; padding: 15px; text-align: center; font-size: 12px; color: #6b7280; border-radius: 0 0 5px 5px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${productEmoji} Application Received!</h1>
          <p style="margin: 0; font-size: 16px;">We're processing your ${productType.toLowerCase().replace('_', ' ')} application</p>
        </div>
        
        <div class="content">
          <p>Dear ${name},</p>
          
          <p>Thank you for choosing Six Loans! We have successfully received your application for <strong>${productName}</strong>.</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #0d9488;">📋 Application Details</h3>
            <div class="info-row">
              <span class="info-label">Reference Number:</span>
              <span class="info-value">${referenceNo}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Product Name:</span>
              <span class="info-value">${productName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Product Type:</span>
              <span class="info-value">${productType.replace('_', ' ')}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Status:</span>
              <span class="status-badge">⏳ Under Review</span>
            </div>
          </div>
          
          <h3 style="color: #0d9488;">🔄 What Happens Next?</h3>
          
          <div class="timeline">
            <div class="timeline-item">
              <strong>Step 1: Document Verification</strong><br>
              Our team will verify all the documents you've submitted. This usually takes 2-4 hours.
            </div>
            
            <div class="timeline-item">
              <strong>Step 2: Credit Assessment</strong><br>
              We'll assess your application based on eligibility criteria and credit profile.
            </div>
            
            <div class="timeline-item">
              <strong>Step 3: Executive Review</strong><br>
              One of our loan executives will review your application and may contact you for additional information.
            </div>
            
            <div class="timeline-item">
              <strong>Step 4: Final Decision</strong><br>
              You'll receive a notification about the approval status via email and SMS.
            </div>
          </div>
          
          <p><strong>⏱️ Expected Processing Time:</strong> 1-3 business days</p>
          
          <p><strong>📱 Track Your Application:</strong><br>
          You can track your application status anytime by logging into your account and visiting the "My Applications" section.</p>
          
          <p><strong>💡 Pro Tip:</strong> Keep your phone handy! Our executive may call you for verification or additional details.</p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p><strong>Need Help?</strong><br>
          Our support team is available 24/7 to assist you. Feel free to reach out if you have any questions.</p>
          
          <p>Best regards,<br><strong>The Six Loans Team</strong></p>
        </div>
        
        <div class="footer">
          <p>&copy; 2026 Six Loans. All rights reserved.</p>
          <p>📧 support@sixloans.com | 📞 1800-XXX-XXXX</p>
          <p style="margin-top: 10px;">Reference: ${referenceNo}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `Application Received - ${productName}. Reference: ${referenceNo}. Status: Under Review. Our team will verify your application within 1-3 business days. Track your application at: ${process.env.FRONTEND_URL || 'http://localhost:3000'}/user/applications`;

  return sendEmail({
    to: email,
    subject,
    html,
    text,
  });
};
