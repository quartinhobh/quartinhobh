import React, { createContext, useContext, useState, useCallback } from 'react';

interface HelperContextValue {
  helperOn: boolean;
  toggleHelper: () => void;
}

const HelperContext = createContext<HelperContextValue>({
  helperOn: false,
  toggleHelper: () => {},
});

export const HelperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [helperOn, setHelperOn] = useState(() => {
    return localStorage.getItem('admin-helper') === 'true';
  });

  const toggleHelper = useCallback(() => {
    setHelperOn((prev) => {
      const next = !prev;
      localStorage.setItem('admin-helper', String(next));
      return next;
    });
  }, []);

  return (
    <HelperContext.Provider value={{ helperOn, toggleHelper }}>
      {children}
    </HelperContext.Provider>
  );
};

export function useHelper() {
  return useContext(HelperContext);
}
