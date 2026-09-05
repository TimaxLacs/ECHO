declare module "zonosjs" {
  class ZonosJS {
    generateSpeech(text: string, voice?: string, language?: string): Promise<Buffer | Uint8Array>;
  }
  export default ZonosJS;
}
