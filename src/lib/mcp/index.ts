import { mcp } from "@/lib/mcp/registry";
import { placesTools } from "@/lib/mcp/servers/places";
import { deployTools } from "@/lib/mcp/servers/deploy";
import { commsTools } from "@/lib/mcp/servers/comms";
import { voiceTools } from "@/lib/mcp/servers/voice";
import { adsTools } from "@/lib/mcp/servers/ads";

let bootstrapped = false;

/** Idempotently register all built-in MCP servers onto the shared bus. */
export function ensureMcpBootstrapped(): typeof mcp {
  if (!bootstrapped) {
    mcp.registerAll(placesTools);
    mcp.registerAll(deployTools);
    mcp.registerAll(commsTools);
    mcp.registerAll(voiceTools);
    mcp.registerAll(adsTools);
    bootstrapped = true;
  }
  return mcp;
}

export { mcp };
