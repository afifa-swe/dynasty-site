import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

interface RulesFormState {
  basePointsPerDollar: string;
  websiteBonusPercent: string;
  telegramBonusPercent: string;
  highValueThreshold: string;
  highValueBonusPercent: string;
  decayPerDay: string;
}

interface AdminRulesTabProps {
  rulesForm: RulesFormState;
  setRulesForm: (next: RulesFormState) => void;
  onSaveRules: () => void;
}

export function AdminRulesTab({ rulesForm, setRulesForm, onSaveRules }: AdminRulesTabProps) {
  return (
    <div className="flex min-h-0 flex-col gap-5 overflow-visible pr-1">
      <div className="relative bg-slate-800/40 backdrop-blur-sm border border-amber-500/20 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <h2 className="text-sm sm:text-base text-white">Rules</h2>
          <span className="text-[11px] sm:text-xs text-amber-400/60">Scoring configuration</span>
        </div>
        <div className="mb-3 sm:mb-4 text-[11px] sm:text-xs text-amber-400/60 leading-relaxed">
          <div>Formula: base = amount * base points. Total = base + source bonus % (+ high value bonus % when amount &gt;= threshold).</div>
          <div>Decay per day is reserved (not applied yet). Changes affect new purchases only.</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div className="space-y-2">
            <Label className="text-amber-400/70 text-xs">Base points</Label>
            <Input
              type="number"
              value={rulesForm.basePointsPerDollar}
              onChange={(e) => setRulesForm({ ...rulesForm, basePointsPerDollar: e.target.value })}
              className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-amber-400/70 text-xs">Website bonus %</Label>
            <Input
              type="number"
              value={rulesForm.websiteBonusPercent}
              onChange={(e) => setRulesForm({ ...rulesForm, websiteBonusPercent: e.target.value })}
              className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-amber-400/70 text-xs">Telegram bonus %</Label>
            <Input
              type="number"
              value={rulesForm.telegramBonusPercent}
              onChange={(e) => setRulesForm({ ...rulesForm, telegramBonusPercent: e.target.value })}
              className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-amber-400/70 text-xs">High value threshold</Label>
            <Input
              type="number"
              value={rulesForm.highValueThreshold}
              onChange={(e) => setRulesForm({ ...rulesForm, highValueThreshold: e.target.value })}
              className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-amber-400/70 text-xs">High value bonus %</Label>
            <Input
              type="number"
              value={rulesForm.highValueBonusPercent}
              onChange={(e) => setRulesForm({ ...rulesForm, highValueBonusPercent: e.target.value })}
              className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-amber-400/70 text-xs">Decay per day</Label>
            <Input
              type="number"
              value={rulesForm.decayPerDay}
              onChange={(e) => setRulesForm({ ...rulesForm, decayPerDay: e.target.value })}
              className="h-10 sm:h-11 text-sm sm:text-base bg-slate-900/60 border-amber-500/20 text-white"
            />
          </div>
        </div>
        <div className="mt-3 sm:mt-4">
          <Button
            onClick={onSaveRules}
            className="h-10 sm:h-11 w-full text-sm sm:text-base bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
          >
            Save Rules
          </Button>
        </div>
      </div>
    </div>
  );
}
