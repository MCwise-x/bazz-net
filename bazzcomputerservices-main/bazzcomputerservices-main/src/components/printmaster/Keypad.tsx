import { Delete } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Keypad({
  value,
  onChange,
  onSubmit,
  maxLen = 6,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  maxLen?: number;
}) {
  const press = (k: string) => {
    if (value.length < maxLen) onChange(value + k);
  };
  const back = () => onChange(value.slice(0, -1));
  const clear = () => onChange("");
  const keys = ["1","2","3","4","5","6","7","8","9"];
  return (
    <div className="grid grid-cols-3 gap-3 w-full max-w-xs mx-auto">
      {keys.map((k) => (
        <Button
          key={k}
          variant="secondary"
          onClick={() => press(k)}
          className="h-16 text-2xl font-semibold"
        >
          {k}
        </Button>
      ))}
      <Button variant="outline" onClick={clear} className="h-16 text-sm">
        Clear
      </Button>
      <Button variant="secondary" onClick={() => press("0")} className="h-16 text-2xl font-semibold">
        0
      </Button>
      <Button variant="outline" onClick={back} className="h-16">
        <Delete className="size-5" />
      </Button>
      <Button
        onClick={onSubmit}
        disabled={value.length !== maxLen}
        className="col-span-3 h-14 text-lg font-semibold"
      >
        Enter
      </Button>
    </div>
  );
}