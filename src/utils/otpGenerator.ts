export const generateOTP = (length: number = 6): string => {
  const digits = '0123456789';
  let otp = '';
  
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * digits.length)];
  }
  
  return otp;
};

export const getOTPExpiry = (minutes: number = 10): Date => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + minutes);
  return now;
};

export const isOtpExpired = (expiryTime: Date | null): boolean => {
  if (!expiryTime) return true;
  return new Date() > expiryTime;
};
