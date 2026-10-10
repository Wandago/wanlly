import { SpinLoader } from "@/components/spin-mark";

/** While a page in the app loads, the sidebar and sponsor panel stay put and the work area shows this. */
export default function AppLoading() {
  return (
    <div className="grid h-full min-h-[50vh] place-items-center">
      <SpinLoader size={56} />
    </div>
  );
}
