import { useState } from "react";
import { View } from "react-native";
import { useSpf } from "@/hooks/use-spf";
import SpfPreview from "@/components/spf/spf-preview";
import SpfModal from "@/components/spf/spf-modal";

export default function SpfTile({ highlight }: { highlight?: boolean }) {
  const spf = useSpf();
  const [open, setOpen] = useState(false);

  return (
    <View>
      <SpfPreview
        loaded={spf.loaded}
        state={spf.state}
        remainingMs={spf.remainingMs}
        intervalMs={spf.intervalMin * 60 * 1000}
        lastAppliedAt={spf.lastAppliedAt}
        todayCount={spf.todayCount}
        canUndo={spf.canUndo}
        apply={spf.apply}
        undo={spf.undo}
        onPress={() => setOpen(true)}
        highlight={highlight}
      />
      <SpfModal
        visible={open}
        state={spf.state}
        remainingMs={spf.remainingMs}
        lastAppliedAt={spf.lastAppliedAt}
        firstAppliedAt={spf.firstAppliedAt}
        intervalMin={spf.intervalMin}
        windowEndMin={spf.windowEndMin}
        todayCount={spf.todayCount}
        indoorsToday={spf.indoorsToday}
        saveInterval={spf.saveInterval}
        setIndoors={spf.setIndoors}
        clearIndoors={spf.clearIndoors}
        resetToday={spf.resetToday}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
