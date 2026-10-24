import { useState } from "react";
import { View } from "react-native";
import { useWaterIntake } from "@/hooks/use-water-intake";
import WaterPreview from "@/components/water/water-preview";
import WaterModal from "@/components/water/water-modal";

export default function WaterIntakeCard({
  highlight,
}: {
  highlight?: boolean;
}) {
  const water = useWaterIntake();
  const [open, setOpen] = useState(false);
  const [expandCalculator, setExpandCalculator] = useState(false);

  const openDropdown = (calc = false) => {
    setExpandCalculator(calc);
    setOpen(true);
  };

  return (
    <View>
      <WaterPreview
        loaded={water.loaded}
        intakeMl={water.intakeMl}
        goalMl={water.goalMl}
        progress={water.progress}
        percent={water.percent}
        goalMet={water.goalMet}
        isFirstTime={water.isFirstTime}
        incrementMl={water.incrementMl}
        canUndo={water.canUndo}
        burstActive={water.burstActive}
        displayMl={water.displayMl}
        add={water.add}
        undo={water.undo}
        onPress={() => openDropdown(false)}
        onAddWhenNoGoal={() => openDropdown(true)}
        highlight={highlight}
      />
      <WaterModal
        visible={open}
        expandCalculator={expandCalculator}
        isMetric={water.isMetric}
        prefs={water.prefs}
        intakeMl={water.intakeMl}
        goalMl={water.goalMl}
        percent={water.percent}
        goalMet={water.goalMet}
        isFirstTime={water.isFirstTime}
        incrementMl={water.incrementMl}
        displayMl={water.displayMl}
        saveGoal={water.saveGoal}
        saveIncrement={water.saveIncrement}
        reset={water.reset}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}
