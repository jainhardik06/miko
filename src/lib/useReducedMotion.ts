"use client";
import { useEffect, useState } from 'react';

export function useReducedMotion(){
  const [pref, setPref] = useState(false);
  useEffect(()=>{
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = ()=> setPref(mq.matches);
    update(); mq.addEventListener('change', update);
    return ()=> mq.removeEventListener('change', update);
  },[]);
  return pref;
}

export default useReducedMotion;