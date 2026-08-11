import { PinGate } from './components/PinGate.js';
import { ScoreController } from './components/ScoreController.js';

export function App(): React.JSX.Element {
  return (
    <PinGate>
      <ScoreController />
    </PinGate>
  );
}
