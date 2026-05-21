import React, { createContext, useContext, useState } from 'react';

interface AnoContextType {
  ano: number;
  setAno: (a: number) => void;
}

const AnoContext = createContext<AnoContextType>({
  ano: new Date().getFullYear(),
  setAno: () => {},
});

export function AnoProvider({ children }: { children: React.ReactNode }) {
  const [ano, setAno] = useState(new Date().getFullYear());
  return <AnoContext.Provider value={{ ano, setAno }}>{children}</AnoContext.Provider>;
}

export const useAno = () => useContext(AnoContext);
