import { NextResponse } from "next/server";
import { uploadGameMedia } from "@/lib/cloudinary";

export async function POST(req: Request) {
  try {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return NextResponse.json(
        { error: "Cloudinary is not configured" },
        { status: 503 },
      );
    }
    const form = await req.formData();
    const file = form.get("file");
    const folder = String(form.get("folder") ?? "games");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: "file required" }, { status: 400 });
    }
    const buf = Buffer.from(await file.arrayBuffer());
    const result = await uploadGameMedia(buf, folder);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
