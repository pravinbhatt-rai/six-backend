import admin from "firebase-admin";

let app: admin.app.App | null = null;

export function getFirebaseAdminApp(): admin.app.App {
  if (app) return app;

  const serviceJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!serviceJson) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON env var is not set");
  }
  const credentials = JSON.parse(serviceJson);

  app = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: credentials.project_id,
      clientEmail: credentials.client_email,
      privateKey: credentials.private_key,
    }),
  });

  return app;
}

export function getFirebaseAuth(): admin.auth.Auth {
  return getFirebaseAdminApp().auth();
}
