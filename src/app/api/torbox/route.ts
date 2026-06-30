import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  let path = req.nextUrl.searchParams.get("p");
  if (!path) {
    return NextResponse.json({ success: false, detail: "Missing path parameter 'p'" }, { status: 400 });
  }

  const apiKey = req.headers.get("x-torbox-key");
  if (!apiKey) {
    return NextResponse.json({ success: false, detail: "Missing x-torbox-key header" }, { status: 401 });
  }

  // Substitute __KEY__ with the actual API key if present in the path (used for requestdl)
  path = path.replace("__KEY__", encodeURIComponent(apiKey));

  const targetUrl = `https://api.torbox.app${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      // Do not cache these requests as TorBox data changes frequently
      cache: "no-store", 
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json(data || { success: true }, {
      status: response.status,
    });
  } catch (error: any) {
    console.error("Torbox proxy error:", error);
    return NextResponse.json({ success: false, detail: error.message }, { status: 500 });
  }
}
