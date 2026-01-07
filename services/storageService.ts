
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

export const uploadImage = async (path: string, base64String: string): Promise<string> => {
  const storageRef = ref(storage, path);
  // Remove data:image/xxx;base64, prefix if exists
  const pureBase64 = base64String.includes(",") ? base64String.split(",")[1] : base64String;
  await uploadString(storageRef, pureBase64, 'base64');
  return await getDownloadURL(storageRef);
};
