import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export async function logAuditEvent(action: string, target: string, details?: string) {
  try {
    const userEmail = auth.currentUser?.email || "founder@trivium.tech";
    await addDoc(collection(db, "audit_logs"), {
      action,
      target,
      user: userEmail,
      timestamp: new Date().toISOString(),
      details: details || "",
    });
  } catch (err) {
    console.warn("Falha silenciosa ao registrar audit log:", err);
  }
}
