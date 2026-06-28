import { ChevronDown, ChevronUp } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useState, useRef } from 'react';
import { NumericFormat, type NumericFormatProps } from 'react-number-format';
import { Button } from './button';
import { Input } from './input';
import { cn } from '@/lib/utils';

export interface NumberInputProps
  extends Omit<NumericFormatProps, 'value' | 'onValueChange'> {
  stepper?: number;
  thousandSeparator?: string;
  placeholder?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  value?: number;
  suffix?: string;
  prefix?: string;
  onValueChange?: (value: number | undefined) => void;
  fixedDecimalScale?: boolean;
  decimalScale?: number;
  className?: string;
}

export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(
  (
    {
      stepper,
      thousandSeparator,
      placeholder,
      defaultValue,
      min = -Infinity,
      max = Infinity,
      onValueChange,
      fixedDecimalScale = false,
      decimalScale = 0,
      suffix,
      prefix,
      value: controlledValue,
      className,
      onBlur,
      ...props
    },
    ref
  ) => {
    const internalRef = useRef<HTMLInputElement>(null);
    const combinedRef = ref || internalRef;
    const [value, setValue] = useState<number | undefined>(
      controlledValue ?? defaultValue
    );

    const handleIncrement = useCallback(() => {
      const next =
        value === undefined
          ? stepper ?? 1
          : Math.min(value + (stepper ?? 1), max);
      setValue(next);
      onValueChange?.(next);
    }, [value, stepper, max, onValueChange]);

    const handleDecrement = useCallback(() => {
      const next =
        value === undefined
          ? -(stepper ?? 1)
          : Math.max(value - (stepper ?? 1), min);
      setValue(next);
      onValueChange?.(next);
    }, [value, stepper, min, onValueChange]);

    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (
          document.activeElement ===
          (combinedRef as React.RefObject<HTMLInputElement>).current
        ) {
          if (e.key === 'ArrowUp') {
            handleIncrement();
          } else if (e.key === 'ArrowDown') {
            handleDecrement();
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => {
        window.removeEventListener('keydown', handleKeyDown);
      };
    }, [handleIncrement, handleDecrement, combinedRef]);

    useEffect(() => {
      if (controlledValue !== undefined) {
        setValue(controlledValue);
      }
    }, [controlledValue]);

    const handleChange = (values: {
      value: string;
      floatValue: number | undefined;
    }) => {
      const newValue =
        values.floatValue === undefined ? undefined : values.floatValue;
      setValue(newValue);
      if (onValueChange) {
        onValueChange(newValue);
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      if (value !== undefined) {
        if (value < min) {
          setValue(min);
          onValueChange?.(min);
          (ref as React.RefObject<HTMLInputElement>).current!.value =
            String(min);
        } else if (value > max) {
          setValue(max);
          onValueChange?.(max);
          (ref as React.RefObject<HTMLInputElement>).current!.value =
            String(max);
        }
      }
      onBlur?.(e);
    };

    return (
      <div className={cn("flex items-center", className)}>
        <NumericFormat
          value={value}
          onValueChange={handleChange}
          thousandSeparator={thousandSeparator}
          decimalScale={decimalScale}
          fixedDecimalScale={fixedDecimalScale}
          allowNegative={min < 0}
          valueIsNumericString
          onBlur={handleBlur}
          max={max}
          min={min}
          suffix={suffix}
          prefix={prefix}
          customInput={Input}
          placeholder={placeholder}
          className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-r-none relative h-full font-mono tabular-nums"
          getInputRef={combinedRef}
          {...props}
        />
        <div className="flex flex-col h-full">
          <Button
            aria-label="Increase value"
            className="px-1 rounded-l-none rounded-br-none border-input border-l-0 border-b-[0.5px] focus-visible:relative h-1/2 w-4 min-h-0"
            variant="outline"
            onClick={handleIncrement}
            disabled={value === max}
            type="button"
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            aria-label="Decrease value"
            className="px-1 rounded-l-none rounded-tr-none border-input border-l-0 border-t-[0.5px] focus-visible:relative h-1/2 w-4 min-h-0"
            variant="outline"
            onClick={handleDecrement}
            disabled={value === min}
            type="button"
          >
            <ChevronDown size={15} />
          </Button>
        </div>
      </div>
    );
  }
);
