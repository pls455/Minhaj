import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  addDoc,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "./firebase";

export type ContentStatus = "draft" | "pending_review" | "published" | "archived";

export async function getAdminInbox(limitCount = 50) {
  const resources = await getDocs(
    query(
      collection(db, "sourceRegistry"),
      where("needsReview", "==", true),
      orderBy("updatedAt", "desc"),
      limit(limitCount),
    ),
  );
  return resources.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function getSubjectContent(subjectId: string, limitCount = 100) {
  const result = await getDocs(
    query(
      collection(db, "resources"),
      where("subjectId", "==", subjectId),
      orderBy("order", "asc"),
      limit(limitCount),
    ),
  );
  return result.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function isDuplicateResourceUrl(url: string, excludeId?: string) {
  const result = await getDocs(
    query(collection(db, "resources"), where("url", "==", url), limit(2)),
  );
  return result.docs.some((item) => item.id !== excludeId);
}

export async function createAdminLog(action: string, entityType: string, entityId: string, details: Record<string, unknown> = {}) {
  await addDoc(collection(db, "adminLogs"), {
    action,
    entityType,
    entityId,
    details,
    createdAt: serverTimestamp(),
  });
}

export async function setResourceStatus(resourceId: string, status: ContentStatus) {
  await updateDoc(doc(db, "resources", resourceId), {
    status,
    active: status === "published",
    updatedAt: serverTimestamp(),
  });
  await createAdminLog("status_change", "resource", resourceId, { status });
}
