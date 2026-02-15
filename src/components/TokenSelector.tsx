import { TOKEN_LIST, type TokenInfo } from "@/constants";

interface TokenSelectorProps {
  value: string;
  onChange: (address: string) => void;
  label?: string;
}

export function TokenSelector({
  value,
  onChange,
  label = "Token",
}: TokenSelectorProps) {
  return (
    <div>
      {label && (
        <label className="block text-[10px] opacity-50 uppercase tracking-wider mb-1">
          {label}
        </label>
      )}
      <div className="flex gap-1">
        {TOKEN_LIST.map((token: TokenInfo) => (
          <button
            key={token.address}
            type="button"
            onClick={() => onChange(token.address)}
            className={`flex-1 border px-2 py-2 text-center transition-colors ${
              value.toLowerCase() === token.address.toLowerCase()
                ? "border-white/50 opacity-90"
                : "border-white/10 opacity-40 hover:opacity-60 hover:border-white/30"
            }`}
          >
            <span className="block text-[11px]">{token.symbol}</span>
            <span className="block text-[9px] opacity-50">{token.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
