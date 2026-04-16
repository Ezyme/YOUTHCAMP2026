import { v2 as cloudinary } from "cloudinary";

export function configureCloudinary(): void {
  const cloud_name = process.env.CLOUDINARY_CLOUD_NAME;
  const api_key = process.env.CLOUDINARY_API_KEY;
  const api_secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud_name || !api_key || !api_secret) {
    return;
  }
  cloudinary.config({ cloud_name, api_key, api_secret, secure: true });
}

export async function uploadGameMedia(
  file: Buffer,
  folder: string,
  publicId?: string,
): Promise<{ url: string; publicId: string }> {
  configureCloudinary();
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary is not configured");
  }
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: `youthcamp/${folder}`,
        public_id: publicId,
        resource_type: "auto",
      },
      (err, result) => {
        if (err || !result) {
          reject(err ?? new Error("Upload failed"));
          return;
        }
        resolve({ url: result.secure_url, publicId: result.public_id });
      },
    );
    uploadStream.end(file);
  });
}
