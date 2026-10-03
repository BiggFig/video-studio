import backend from '../../docs/meta-ad-research/backend.json';
import interfaceResearch from '../../docs/meta-ad-research/interface.json';
import { parseAdReferences } from './schema';

// Only reviewed observations belong here. Empty contributions show an honest empty state.
export const adReferences = parseAdReferences([...backend, ...interfaceResearch]);
