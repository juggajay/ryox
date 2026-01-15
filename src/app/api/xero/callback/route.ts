import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const baseUrl = request.nextUrl.origin;

  // Handle error from Xero
  if (error) {
    console.error("Xero OAuth error:", error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/settings?tab=integrations&error=${encodeURIComponent(errorDescription || error)}`,
        baseUrl
      )
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?tab=integrations&error=Missing+authorization+code", baseUrl)
    );
  }

  try {
    // Get OAuth session from Convex to retrieve code verifier
    const oauthSession = await convex.query(api.xero.getOAuthSessionPublic, { state });

    if (!oauthSession) {
      throw new Error("Invalid or expired OAuth session");
    }

    const clientId = process.env.XERO_CLIENT_ID;
    const clientSecret = process.env.XERO_CLIENT_SECRET;
    const redirectUri = process.env.XERO_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error("Xero credentials not configured");
    }

    // Exchange code for tokens with PKCE code_verifier
    const tokenResponse = await fetch("https://identity.xero.com/connect/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: oauthSession.codeVerifier,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Token exchange failed:", errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();

    // Get Xero tenant (organization) info
    const connectionsResponse = await fetch("https://api.xero.com/connections", {
      headers: {
        Authorization: `Bearer ${tokens.access_token}`,
        "Content-Type": "application/json",
      },
    });

    if (!connectionsResponse.ok) {
      throw new Error("Failed to get Xero connections");
    }

    const connections = await connectionsResponse.json();
    if (!connections || connections.length === 0) {
      throw new Error("No Xero organizations found. Please ensure you have access to at least one Xero organization.");
    }

    // Use first connected organization
    const tenant = connections[0];

    // Store tokens in Convex
    await convex.mutation(api.xero.storeTokensPublic, {
      state,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      tenantId: tenant.tenantId,
      tenantName: tenant.tenantName,
    });

    return NextResponse.redirect(
      new URL("/settings?tab=integrations&success=connected", baseUrl)
    );
  } catch (error) {
    console.error("Xero OAuth callback error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(
        `/settings?tab=integrations&error=${encodeURIComponent(errorMessage)}`,
        baseUrl
      )
    );
  }
}
