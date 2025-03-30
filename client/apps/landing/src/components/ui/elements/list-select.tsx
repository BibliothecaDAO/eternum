import { ReactComponent as CaretDown } from "@/assets/icons/common/caret-down-fill.svg";
import { ReactComponent as Checkmark } from "@/assets/icons/common/checkmark.svg";
import { Listbox, ListboxButton, ListboxOption, ListboxOptions, Transition } from "@headlessui/react";
import clsx from "clsx";
import { Fragment, ReactNode, useMemo } from "react";

interface ListSelectOption {
  id: any;
  label: ReactNode;
}

type ListSelectProps = {
  title?: string;
  options: ListSelectOption[];
  value: any;
  onChange: (value: any) => void;
  className?: string;
  style?: "default" | "black";
  disabled?: boolean;
};

function ListSelect(props: ListSelectProps) {
  const selectedOption = useMemo(
    () =>
      props.options.find((option) => option.id === props.value) ||
      props.options[0] || { id: "", label: "Select a resource..." },
    [props.value],
  );
  return (
    <div className={clsx("w-full", props.className, "z-100")}>
      <Listbox value={props.value} onChange={props.onChange} disabled={props.disabled}>
        {({ open }) => (
          <div>
            <ListboxButton
              className={clsx(
                "flex items-center relative  cursor-pointer text-xs py-1 min-h-[32px] z-0 w-full bg-gold/10 hover:bg-gold/20 px-2",
              )}
            >
              {props.title && <span className="truncate w-full flex items-center !text-gold mr-2">{props.title}</span>}
              <span className="truncate flex w-full items-center">{selectedOption.label}</span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <div className="flex flex-col items-center justify-center ml-1">
                  <CaretDown
                    className={clsx("stroke-gold fill-gold transition-transform duration-100", open && "rotate-180")}
                  />
                </div>
              </span>
            </ListboxButton>
            <Transition
              as={Fragment}
              show={open}
              appear
              enter="transition ease-out duration-100"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="transition ease-in duration-100"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed z-50 w-min text-xs">
                <ListboxOptions
                  anchor="bottom start"
                  className={clsx(
                    "z-50 rounded-md py-1 max-h-72 overflow-scroll z-100 border border-gold/10 no-scrollbar",
                    props.style === "black" ? "bg-brown" : " bg-brown",
                  )}
                >
                  {props.options.map((option) => (
                    <ListboxOption
                      key={option.id}
                      className={({ active }) =>
                        `overflow-visible relative cursor-pointer z-50 select-none py-2 flex items-center pl-8 text-gold ${
                          active ? "bg-gold/10 text-white/90" : ""
                        }`
                      }
                      value={option.id}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={`z-50 flex items-center  truncate ${
                              selected ? "font-bold text-white" : "font-normal"
                            }`}
                          >
                            {option.label}
                          </span>
                          {selected ? (
                            <span className="z-50 absolute inset-y-0 left-0 flex items-center pl-3">
                              <Checkmark className="h-3 w-3 fill-gold " aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </ListboxOption>
                  ))}
                </ListboxOptions>
              </div>
            </Transition>
          </div>
        )}
      </Listbox>
    </div>
  );
}

export default ListSelect;
