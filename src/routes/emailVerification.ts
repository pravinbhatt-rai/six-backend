import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateOTP, getOTPExpiry } from '../utils/otpGenerator';
import { sendOtpEmail } from '../utils/emailService';

const prisma = new PrismaClient();
const router = Router();

/**
 * POST /api/email-verification/send-otp
 * Send OTP to user's email
 */
router.post('/send-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if email is already verified
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Generate OTP
    const otp = generateOTP(parseInt(process.env.OTP_LENGTH || '6'));
    const otpExpiry = getOTPExpiry(parseInt(process.env.OTP_EXPIRY_MINUTES || '10'));

    // Save OTP to database
    await prisma.user.update({
      where: { email },
      data: {
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
      },
    });

    // Send OTP email
    const emailSent = await sendOtpEmail(email, otp, user.name);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
      expiryMinutes: process.env.OTP_EXPIRY_MINUTES || 10,
    });
  } catch (error) {
    console.error('Error sending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
});

/**
 * POST /api/email-verification/verify-otp
 * Verify OTP and mark email as verified
 */
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    // Validate OTP length
    if (otp.length < 4 || otp.length > 8) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP format',
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if email already verified
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Check if OTP exists
    if (!user.emailOtp) {
      return res.status(400).json({
        success: false,
        message: 'No OTP found. Please request a new OTP',
      });
    }

    // Check if OTP is expired
    if (user.emailOtpExpiry && new Date() > user.emailOtpExpiry) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new OTP',
      });
    }

    // Verify OTP
    if (user.emailOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Invalid OTP. Please try again',
      });
    }

    // Update user - mark email as verified and clear OTP
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailOtp: null,
        emailOtpExpiry: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
});

/**
 * POST /api/email-verification/resend-otp
 * Resend OTP to email
 */
router.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required',
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified',
      });
    }

    // Generate new OTP
    const otp = generateOTP(parseInt(process.env.OTP_LENGTH || '6'));
    const otpExpiry = getOTPExpiry(parseInt(process.env.OTP_EXPIRY_MINUTES || '10'));

    // Update OTP in database
    await prisma.user.update({
      where: { email },
      data: {
        emailOtp: otp,
        emailOtpExpiry: otpExpiry,
      },
    });

    // Send OTP email
    const emailSent = await sendOtpEmail(email, otp, user.name);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email. Please try again later.',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'OTP resent successfully',
      expiryMinutes: process.env.OTP_EXPIRY_MINUTES || 10,
    });
  } catch (error) {
    console.error('Error resending OTP:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? String(error) : undefined,
    });
  }
});

/**
 * GET /api/email-verification/status/:email
 * Check email verification status
 */
router.get('/status/:email', async (req: Request, res: Response) => {
  try {
    const { email } = req.params;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        emailVerified: true,
        emailVerifiedAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    return res.status(200).json({
      success: true,
      emailVerified: user.emailVerified,
      emailVerifiedAt: user.emailVerifiedAt,
    });
  } catch (error) {
    console.error('Error checking verification status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
