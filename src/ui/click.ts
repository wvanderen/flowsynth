// A release click belongs to its gesture. Both the listener and its timer
// are cancellable so they cannot swallow a replacement instrument's click.
export function suppressNextClick(onFinish: () => void = () => {}): () => void {
  const target = document;
  const finish = () => {
    clearTimeout(timer);
    target.removeEventListener("click", suppress, true);
    onFinish();
  };
  const suppress = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    finish();
  };
  target.addEventListener("click", suppress, { capture: true, once: true });
  const timer = setTimeout(finish, 0);
  return finish;
}
