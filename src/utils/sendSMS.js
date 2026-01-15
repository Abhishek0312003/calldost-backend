import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

class Fast2SMS {
  constructor() {
    this.apiKey = process.env.FAST2SMS_API_KEY;
    this.baseURL = "https://www.fast2sms.com/dev/bulkV2";
    this.senderId = "VEREDA"; // DLT registered
    this.superAdminTemplateId = "191095"; // Replace with real DLT template ID
  }

  // ================= OTP =================
  async sendOtp(phone, otp) {
    try {
      const queryParams = new URLSearchParams({
        authorization: this.apiKey,
        route: "otp",
        variables_values: otp,
        numbers: phone,
      });

      const res = await fetch(`${this.baseURL}?${queryParams}`);
      const data = await res.json();

      return data.return === true
        ? { success: true }
        : { success: false, message: data.message };
    } catch (err) {
      console.error("OTP SMS Error:", err);
      return { success: false };
    }
  }

  // ================= NOTIFICATION =================
  async sendSuperAdminCreatedSMS(phone, name) {
    try {
      const queryParams = new URLSearchParams({
        authorization: this.apiKey,
        route: "dlt",
        sender_id: this.senderId,
        message: this.superAdminTemplateId,
        variables_values: name,
        numbers: phone,
      });

      const res = await fetch(`${this.baseURL}?${queryParams}`);
      const data = await res.json();

      return data.return === true
        ? { success: true }
        : { success: false, message: data.message };
    } catch (err) {
      console.error("SuperAdmin SMS Error:", err);
      return { success: false };
    }
  }
}

export default new Fast2SMS();
