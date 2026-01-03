type OtpData = {
  otp: string;
  expires: number;
};

const otpStore = new Map<string, OtpData>();

export const saveOtp = (phone: string, otp: string) => {
  const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
  otpStore.set(phone, { otp, expires });
};

export const verifyOtp = (phone: string, otp: string): boolean => {
  const data = otpStore.get(phone);
  if (!data) return false;
  if (Date.now() > data.expires) {
    otpStore.delete(phone);
    return false;
  }
  if (data.otp === otp) {
    otpStore.delete(phone);
    return true;
  }
  return false;
};
