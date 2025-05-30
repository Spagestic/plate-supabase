// Simple test to verify Supabase connection
import { createClient } from "@/lib/supabase/client";

export async function testSupabaseConnection() {
  const supabase = createClient();

  console.log("🔍 Testing Supabase connection...");

  try {
    // Try to create a channel to test the connection
    const channel = supabase.channel("test-channel");

    channel
      .on("presence", { event: "sync" }, () => {
        console.log("✅ Supabase connection successful!");
      })
      .on("presence", { event: "join" }, ({ key, newPresences }) => {
        console.log("👋 User joined:", key, newPresences);
      })
      .subscribe(async (status) => {
        console.log("📡 Channel status:", status);
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to test channel");
          // Clean up
          await supabase.removeChannel(channel);
        }
      });
  } catch (error) {
    console.error("❌ Supabase connection failed:", error);
  }
}

// Run the test
testSupabaseConnection();
