import { normalizeItems, validateBuild } from './compatibility.js';

const affectedChecks = {
  cpu: ['CPU_SOCKET_MATCH', 'PSU_WATTAGE_HEADROOM'],
  motherboard: ['CPU_SOCKET_MATCH', 'MEMORY_TYPE_MATCH', 'CASE_FITS_BOARD', 'MEMORY_SLOT_CAPACITY', 'PSU_WATTAGE_HEADROOM'],
  memory: ['MEMORY_TYPE_MATCH', 'MEMORY_SLOT_CAPACITY', 'PSU_WATTAGE_HEADROOM'],
  gpu: ['PSU_WATTAGE_HEADROOM'],
  storage: ['PSU_WATTAGE_HEADROOM'],
  case: ['CASE_FITS_BOARD', 'PSU_WATTAGE_HEADROOM'],
  psu: ['PSU_WATTAGE_HEADROOM']
};

function explainIssue(issue, parts, power, quantity, candidateCategory) {
  switch (issue.code) {
    case 'CPU_SOCKET_MATCH': return candidateCategory === 'cpu'
      ? `${parts.cpu.name} uses ${parts.cpu.socket}; your selected motherboard needs ${parts.motherboard.socket}.`
      : `${parts.motherboard.name} has an ${parts.motherboard.socket} socket; your selected processor uses ${parts.cpu.socket}.`;
    case 'MEMORY_TYPE_MATCH': return `This board takes ${parts.motherboard.memoryType}; the memory is ${parts.memory.memoryType}.`;
    case 'CASE_FITS_BOARD': return `This case supports ${parts.case.supportedFormFactors.join(', ')}, not the selected ${parts.motherboard.formFactor} board.`;
    case 'MEMORY_SLOT_CAPACITY': return `${quantity} memory units need more than this board's ${parts.motherboard.memorySlots} slots.`;
    case 'PSU_WATTAGE_HEADROOM': return `With this part, the build needs ${power.requiredWattage}W including ${power.marginPercent}% headroom; the PSU supplies ${power.supplyRating}W.`;
    default: return issue.message;
  }
}

// The picker uses the same server checks as final validation. It only considers
// failures affected by the candidate, so an unrelated existing issue can be fixed.
export function evaluateComponentOptions(components, items, settings = []) {
  const normalized = normalizeItems(items);
  return components.filter(c => !c.archived).map(component => {
    const current = normalized.find(i => i.component.category === component.category);
    const quantity = current?.quantity ?? 1;
    const trial = [...normalized.filter(i => i.component.category !== component.category), { component, quantity }];
    const parts = Object.fromEntries(trial.map(i => [i.component.category, i.component]));
    const result = validateBuild(trial, settings);
    const reasons = result.issues.filter(i => i.severity === 'error' && affectedChecks[component.category].includes(i.code))
      .map(i => explainIssue(i, parts, result.power, quantity, component.category));
    const available = component.availability !== 'out of stock';
    return { componentId: String(component._id ?? component.id), compatible: reasons.length === 0, available,
      reasons: [...reasons, ...(!available ? ['Out of stock.'] : [])] };
  });
}
