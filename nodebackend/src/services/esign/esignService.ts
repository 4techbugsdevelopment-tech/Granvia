import { env } from '../../config/env';
import { BaseEsignProvider } from './providers/BaseEsignProvider';
import { ConfiguredEsignProvider } from './providers/ConfiguredEsignProvider';
import { SandboxEsignProvider } from './providers/SandboxEsignProvider';

export function getEsignProvider(): BaseEsignProvider {
  if (env.esign.sandboxMode) return new SandboxEsignProvider();
  return new ConfiguredEsignProvider(env.esign.provider);
}
