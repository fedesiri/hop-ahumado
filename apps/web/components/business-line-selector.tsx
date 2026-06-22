"use client";

import { useLineContext } from "@/lib/line-context";
import { BusinessLine } from "@/lib/types";

export function BusinessLineSelector() {
  const { selectedLine, setSelectedLine } = useLineContext();
  const active = selectedLine ?? BusinessLine.BEER;

  return (
    <div className="ha-seg">
      <button
        className={`ha-seg__o${active === BusinessLine.BEER ? " act" : ""}`}
        onClick={() => setSelectedLine(BusinessLine.BEER)}
      >
        Hop
      </button>
      <button
        className={`ha-seg__o${active === BusinessLine.MEAT ? " act" : ""}`}
        onClick={() => setSelectedLine(BusinessLine.MEAT)}
      >
        Alumo
      </button>
    </div>
  );
}
