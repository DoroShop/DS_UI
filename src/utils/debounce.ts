export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: number | undefined;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = window.setTimeout(() => func(...args), wait);
  };
}


// const debounce = (func, delay) => {
//   let timeoutId
//   return (...args) => {
//     clearTimeout(timeoutId)
//     timeoutId = setTimeout(() => func.apply(null, args), delay)
//   }
// }