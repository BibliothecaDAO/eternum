import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

// Define a Zod schema for editing the profile.
// Note: We use a simple string for interests which will be split into an array in the submit handler.
const editProfileSchema = z.object({
  statement: z.string().min(1, "Statement is required"),
  interests: z.string().array().optional(),
  twitter: z.string().optional(),
  github: z.string().optional(),
  telegram: z.string().optional(),
  discord: z.string().optional(),
});

type EditProfileValues = z.infer<typeof editProfileSchema>;

interface EditProfileFormProps {
  // You can pass initial form values when editing an existing profile.
  delegate?: {
    delegateProfile: {
      statement: string;
      interests?: string[];
      twitter: string;
      github: string;
      telegram: string;
      discord: string;
    };
  };
  // The onSubmit callback returns the values with interests converted to a string array.
  onSubmit: (data: EditProfileValues & { interests: string[] }) => void;
}
const interests = [
  { value: "gaming", label: "Gaming" },
  { value: "game-design", label: "Game Design" },
  { value: "game-development", label: "Game Development" },
  { value: "dao", label: "DAO" },
  { value: "defi", label: "DeFi" },
  { value: "autonomous-worlds", label: "Autonomous Worlds" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "esports", label: "Esports" },
  { value: "encryption", label: "Encryption" },
  { value: "ai-in-gaming", label: "AI in Gaming" },
  { value: "nfts", label: "NFTs" },
  { value: "economics", label: "Economics" },
  { value: "cryptography", label: "Cryptography" },
  { value: "scaling", label: "Scaling" },
  { value: "starknet", label: "Starknet" },
  { value: "governance", label: "Governance" },
  { value: "finance", label: "Finance" },
];
export function DelegateProfileForm({
  delegate,
  onSubmit,
}: EditProfileFormProps) {
  const form = useForm<EditProfileValues>({
    resolver: zodResolver(editProfileSchema),
    defaultValues: {
      statement: delegate?.delegateProfile.statement ?? "",
      interests: delegate?.delegateProfile.interests ?? [],
      twitter: delegate?.delegateProfile.twitter ?? "",
      github: delegate?.delegateProfile.github ?? "",
      telegram: delegate?.delegateProfile.telegram ?? "",
      discord: delegate?.delegateProfile.discord ?? "",
    },
  });

  function handleFormSubmit(data: EditProfileValues) {
    onSubmit({ ...data, interests: data.interests ?? [] });
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-8"
      >
        <FormField
          control={form.control}
          name="statement"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Statement</FormLabel>
              <FormControl>
                <Textarea placeholder="Your statement..." {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="interests"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Interests</FormLabel>
              <FormControl>
                <ToggleGroup
                  {...field}
                  onValueChange={field.onChange}
                  type="multiple"
                  variant="outline"
                  size="sm"
                  className="grid grid-cols-4 justify-start lg:grid-cols-6"
                >
                  {interests.map(({ value, label }) => (
                    <ToggleGroupItem
                      className="leading-none"
                      key={value}
                      value={value}
                    >
                      {label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="twitter"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Twitter</FormLabel>
                <FormControl>
                  <Input placeholder="Your Twitter handle" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="github"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Github</FormLabel>
                <FormControl>
                  <Input placeholder="Your Github username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telegram"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telegram</FormLabel>
                <FormControl>
                  <Input placeholder="Your Telegram handle" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="discord"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Discord</FormLabel>
                <FormControl>
                  <Input placeholder="Your Discord username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" className="w-full">
          Save Profile
        </Button>
      </form>
    </Form>
  );
}
